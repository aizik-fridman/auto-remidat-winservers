const emergencyCommandsLinux = [
  {
    label: "Process List",
    command: "top -b -n 1",
    shell: "sh",
  },
  {
    label: "Disk Space",
    command: "df -h",
    shell: "sh",
  },
  {
    label: "Memory Usage",
    command: "free -m",
    shell: "sh",
  },
  {
    label: "Network Stats",
    command: "netstat -tuln",
    shell: "sh",
  },
  {
    label: "System Logs",
    command: "tail -n 50 /var/log/syslog || tail -n 50 /var/log/messages",
    shell: "sh",
  },
  {
    label: "Check CPU",
    command: "uptime",
    shell: "sh",
  },
  {
    label: "Active Users",
    command: "who",
    shell: "sh",
  }
];

export default emergencyCommandsLinux;
