/**
 * Emergency commands available in the web console sidebar.
 */
const emergencyCommands = [
  {
    label: "List Processes",
    command: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, CPU, WorkingSet, Id | Format-Table -AutoSize",
    shell: "powershell",
  },
  {
    label: "Restart Windows Update",
    command: "Restart-Service wuauserv -Force; Get-Service wuauserv",
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
    command: "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}} | Format-Table -AutoSize",
    shell: "powershell",
  },
  {
    label: "Running Services",
    command: "Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name, DisplayName | Format-Table -AutoSize",
    shell: "powershell",
  },
  {
    label: "System Uptime",
    command: "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | Select-Object Days, Hours, Minutes | Format-List",
    shell: "powershell",
  },
  {
    label: "Event Log",
    command: "Get-EventLog -LogName System -Newest 15 -EntryType Error,Warning | Select-Object TimeGenerated, EntryType, Source, Message | Format-Table -AutoSize -Wrap",
    shell: "powershell",
  },
];

export default emergencyCommands;
