export const EMERGENCY_COMMANDS = [
  {
    label: "List Processes",
    command: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 15",
    shell: "powershell",
  },
  {
    label: "Restart Windows Update",
    command: "Restart-Service wuauserv",
    shell: "powershell",
  },
  {
    label: "Flush DNS",
    command: "ipconfig /flushdns",
    shell: "cmd",
  },
  {
    label: "Network Config",
    command: "ipconfig /all",
    shell: "cmd",
  },
  {
    label: "Disk Space",
    command: "Get-PSDrive -PSProvider FileSystem",
    shell: "powershell",
  },
  {
    label: "Running Services",
    command: "Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object -First 20",
    shell: "powershell",
  },
  {
    label: "System Uptime",
    command: "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime",
    shell: "powershell",
  },
  {
    label: "Event Log (System, last 5)",
    command: "Get-EventLog -LogName System -Newest 5",
    shell: "powershell",
  },
];
