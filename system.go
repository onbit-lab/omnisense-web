package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

func getSystemStatus() SystemStatus {
	status := SystemStatus{
		Battery:     getBatteryStatus(),
		Signal:      getNetworkStatus(),
		Temperature: getCPUTemperature(),
		Storage:     getStorageStatus(),
	}
	return status
}

func getBatteryStatus() string {
	powerSupplyDir := "/sys/class/power_supply"
	entries, err := os.ReadDir(powerSupplyDir)
	if err != nil {
		return "전원 정보 없음"
	}

	var hasBattery bool
	var hasActivePower bool
	var batteryLevel string
	var powerType string

	for _, entry := range entries {
		path := powerSupplyDir + "/" + entry.Name()

		// 타입 확인
		if typeData, err := ioutil.ReadFile(path + "/type"); err == nil {
			typeStr := strings.TrimSpace(string(typeData))

			if typeStr == "USB" {
				// USB-C PD 전원 확인 - voltage_now와 current_now로 실제 전력 공급 확인
				if voltageData, err := ioutil.ReadFile(path + "/voltage_now"); err == nil {
					if currentData, err2 := ioutil.ReadFile(path + "/current_now"); err2 == nil {
						voltage := strings.TrimSpace(string(voltageData))
						current := strings.TrimSpace(string(currentData))

						if voltageVal, err3 := strconv.Atoi(voltage); err3 == nil && voltageVal > 1000000 { // 1V 이상
							hasActivePower = true
							powerType = "USB-C 전원"
						} else if currentVal, err4 := strconv.Atoi(current); err4 == nil && currentVal > 100000 { // 100mA 이상
							hasActivePower = true
							powerType = "USB-C 전원"
						}
					}
				}

				// online 상태도 확인
				if onlineData, err := ioutil.ReadFile(path + "/online"); err == nil {
					if strings.TrimSpace(string(onlineData)) == "1" {
						hasActivePower = true
						powerType = "USB-C 전원"
					}
				}
			} else if typeStr == "Mains" || typeStr == "USB_PD" {
				// 일반적인 AC 어댑터 확인
				if onlineData, err := ioutil.ReadFile(path + "/online"); err == nil {
					if strings.TrimSpace(string(onlineData)) == "1" {
						hasActivePower = true
						if typeStr == "USB_PD" {
							powerType = "USB-PD 전원"
						} else {
							powerType = "AC 전원"
						}
					}
				}
			} else if typeStr == "Battery" {
				hasBattery = true
				if capacityData, err := ioutil.ReadFile(path + "/capacity"); err == nil {
					batteryLevel = strings.TrimSpace(string(capacityData)) + "%"
				}
			}
		}
	}

	// 실제 전력 공급 여부 확인 - 시스템이 켜져 있다는 것은 전원이 공급되고 있다는 뜻
	if !hasActivePower {
		// 시스템이 실행 중이므로 어떤 형태로든 전력이 공급되고 있음
		// USB-C 타입이 감지되었다면 USB-C 전원으로 간주
		for _, entry := range entries {
			path := powerSupplyDir + "/" + entry.Name()
			if typeData, err := ioutil.ReadFile(path + "/type"); err == nil {
				if strings.TrimSpace(string(typeData)) == "USB" {
					if usbTypeData, err2 := ioutil.ReadFile(path + "/usb_type"); err2 == nil {
						if strings.Contains(string(usbTypeData), "PD") {
							hasActivePower = true
							powerType = "USB-C PD 전원"
							break
						}
					}
				}
			}
		}
	}

	if hasActivePower {
		if hasBattery && batteryLevel != "" {
			return powerType + " (" + batteryLevel + ")"
		}
		return powerType
	}

	if hasBattery && batteryLevel != "" {
		return batteryLevel
	}

	// 마지막 수단: 시스템이 실행 중이므로 전원 공급 중
	return "전원 공급 중"
}

func getNetworkStatus() string {
	// nmcli로 연결 상태 확인
	cmd := exec.Command("nmcli", "device", "status")
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				deviceName := fields[0]
				deviceType := fields[1]
				state := fields[2]

				if state == "connected" {
					if deviceType == "ethernet" {
						return "유선 연결"
					} else if deviceType == "wifi" {
						// WiFi 신호 강도 확인
						return getWiFiSignalStrengthNmcli(deviceName)
					}
				}
			}
		}
	}

	// 백업: /sys/class/net 디렉토리 확인
	netDir := "/sys/class/net"
	if entries, err := os.ReadDir(netDir); err == nil {
		for _, entry := range entries {
			ifaceName := entry.Name()
			if ifaceName == "lo" {
				continue
			}

			ifacePath := netDir + "/" + ifaceName
			if operData, err := ioutil.ReadFile(ifacePath + "/operstate"); err == nil {
				if strings.TrimSpace(string(operData)) == "up" {
					// 유선 연결 확인
					if strings.HasPrefix(ifaceName, "end") || strings.HasPrefix(ifaceName, "eth") || strings.HasPrefix(ifaceName, "enp") {
						if carrierData, err := ioutil.ReadFile(ifacePath + "/carrier"); err == nil {
							if strings.TrimSpace(string(carrierData)) == "1" {
								return "유선 연결"
							}
						}
					}

					// WiFi 연결 확인
					if strings.HasPrefix(ifaceName, "wl") {
						return getWiFiSignalStrengthNmcli(ifaceName)
					}
				}
			}
		}
	}

	return "연결 없음"
}

func getWiFiSignalStrengthNmcli(deviceName string) string {
	cmd := exec.Command("nmcli", "device", "wifi", "list", "ifname", deviceName)
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for i, line := range lines {
			if i == 0 || !strings.Contains(line, "*") {
				continue
			}
			fields := strings.Fields(line)
			for j := 2; j < len(fields); j++ {
				if val, err := strconv.Atoi(fields[j]); err == nil {
					if val >= 0 && val <= 100 {
						return getSignalStrengthFromPercentage(val)
					} else if val <= 0 && val >= -100 {
						return getSignalStrengthFromDbm(val)
					}
				}
			}
		}
	}
	return "WiFi 연결"
}

func getSignalStrengthFromPercentage(percentage int) string {
	if percentage >= 70 {
		return "WiFi 강함"
	} else if percentage >= 40 {
		return "WiFi 보통"
	}
	return "WiFi 약함"
}

func getSignalStrengthFromDbm(dbm int) string {
	if dbm >= -30 {
		return "WiFi 강함"
	} else if dbm >= -60 {
		return "WiFi 보통"
	}
	return "WiFi 약함"
}

func getCPUTemperature() string {
	// CPU 온도 확인 (여러 경로 시도)
	tempPaths := []string{
		"/sys/class/thermal/thermal_zone0/temp",
		"/sys/class/thermal/thermal_zone1/temp",
		"/sys/devices/virtual/thermal/thermal_zone0/temp",
	}

	for _, path := range tempPaths {
		if data, err := ioutil.ReadFile(path); err == nil {
			tempStr := strings.TrimSpace(string(data))
			if temp, err := strconv.Atoi(tempStr); err == nil {
				// milli-celsius를 celsius로 변환
				celsius := temp / 1000
				return fmt.Sprintf("%d°C", celsius)
			}
		}
	}

	// sensors 명령어 시도
	cmd := exec.Command("sensors")
	if output, err := cmd.Output(); err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(line, "Core 0") || strings.Contains(line, "CPU") {
				if strings.Contains(line, "°C") {
					parts := strings.Fields(line)
					for _, part := range parts {
						if strings.HasSuffix(part, "°C") {
							return part
						}
					}
				}
			}
		}
	}

	return "N/A"
}

func getStorageStatus() string {
	cmd := exec.Command("df", "-h", "/")
	output, err := cmd.Output()
	if err != nil {
		return "N/A"
	}

	lines := strings.Split(string(output), "\n")
	if len(lines) >= 2 {
		fields := strings.Fields(lines[1])
		if len(fields) >= 4 {
			total := fields[1] // 전체 용량
			avail := fields[3] // 사용 가능 용량
			return fmt.Sprintf("%s Free / %s", avail, total)
		}
	}

	return "N/A"
}
