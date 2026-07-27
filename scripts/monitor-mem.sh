#!/usr/bin/env bash
# 持续监测 3000 端口 Nuxt dev server 的内存占用，每 15 秒采样一次写入日志
LOG="/d/Code/DebateTimer/DebateTimerV3/scripts/mem-3000.log"
echo "time pid mem_MB" > "$LOG"
while true; do
  pid=$(netstat -ano 2>/dev/null | sed 's/\r$//' | grep "LISTEN" | grep -E ":3000\b" | awk '{print $NF}' | sort -u | head -1)
  if [ -n "$pid" ]; then
    line=$(tasklist /fi "PID eq $pid" /nh 2>/dev/null | grep -E "node\.exe")
    memkb=$(echo "$line" | awk '{gsub(/,/,"",$5); print $5}')
    if [ -n "$memkb" ]; then
      mb=$(awk "BEGIN{printf \"%.1f\", $memkb/1024}")
      ts=$(date '+%H:%M:%S')
      echo "$ts pid=$pid mem=${mb}MB" >> "$LOG"
    fi
  fi
  sleep 15
done
