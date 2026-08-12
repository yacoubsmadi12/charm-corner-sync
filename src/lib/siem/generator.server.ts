// Server-only: realistic demo/test event generator. All rows are marked is_demo.
import type { LogEventInput, Severity } from "./events.server";

type Template = {
  event_type: string;
  category: string;
  severity: Severity;
  source_type: string;
  vendor: string;
  device_type: string;
  message: (ctx: Ctx) => string;
};

type Ctx = { ip: string; user: string; host: string; port: number };

const USERS = ["ahmad", "sara", "admin", "root", "svc_backup", "j.smith", "operator"];
const HOSTS = ["dc01", "web-prod-01", "fw-edge-01", "linux-app-02", "core-sw-01"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function randIp(prefix = "10.20") {
  return `${prefix}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254) + 1}`;
}

export const TEMPLATES: Template[] = [
  {
    event_type: "failed_login", category: "authentication", severity: "medium",
    source_type: "syslog", vendor: "Linux", device_type: "server",
    message: (c) => `sshd[${1000 + c.port}]: Failed password for ${c.user} from ${c.ip} port ${c.port} ssh2`,
  },
  {
    event_type: "successful_login", category: "authentication", severity: "info",
    source_type: "syslog", vendor: "Linux", device_type: "server",
    message: (c) => `sshd[${1000 + c.port}]: Accepted password for ${c.user} from ${c.ip} port ${c.port} ssh2`,
  },
  {
    event_type: "brute_force", category: "authentication", severity: "high",
    source_type: "windows", vendor: "Microsoft", device_type: "server",
    message: (c) => `EventID 4625 brute force pattern: repeated logon failure for ${c.user} from ${c.ip}`,
  },
  {
    event_type: "port_scan", category: "network", severity: "high",
    source_type: "firewall", vendor: "Fortinet", device_type: "firewall",
    message: (c) => `SYN port scan detected from ${c.ip} targeting ${c.host} ports 20-1024`,
  },
  {
    event_type: "firewall_block", category: "network", severity: "medium",
    source_type: "firewall", vendor: "Fortinet", device_type: "firewall",
    message: (c) => `action=deny src=${c.ip} dst=${randIp("172.16")} dport=${c.port} proto=TCP policy=BLOCK-EXTERNAL`,
  },
  {
    event_type: "malware", category: "threat", severity: "critical",
    source_type: "windows", vendor: "Microsoft", device_type: "endpoint",
    message: (c) => `Defender: malware Trojan:Win32/Emotet quarantined on ${c.host} (user ${c.user})`,
  },
  {
    event_type: "privilege_escalation", category: "authentication", severity: "high",
    source_type: "syslog", vendor: "Linux", device_type: "server",
    message: (c) => `sudo: ${c.user} : TTY=pts/0 ; PWD=/home/${c.user} ; USER=root ; COMMAND=/bin/bash`,
  },
  {
    event_type: "suspicious_login", category: "authentication", severity: "high",
    source_type: "windows", vendor: "Microsoft", device_type: "server",
    message: (c) => `Suspicious authentication for administrator ${c.user} from unusual address ${c.ip}`,
  },
  {
    event_type: "account_lockout", category: "authentication", severity: "high",
    source_type: "windows", vendor: "Microsoft", device_type: "server",
    message: (c) => `EventID 4740 account ${c.user} was locked out on ${c.host}`,
  },
  {
    event_type: "web_attack", category: "web", severity: "critical",
    source_type: "web_server", vendor: "Nginx", device_type: "web_server",
    message: (c) => `${c.ip} - - "GET /index.php?id=1' UNION SELECT password FROM users-- HTTP/1.1" 200 812`,
  },
  {
    event_type: "device_status", category: "infrastructure", severity: "info",
    source_type: "snmp", vendor: "Huawei", device_type: "network_device",
    message: (c) => `SNMP trap linkDown ifIndex=${c.port % 48} on ${c.host}`,
  },
];

export function generateEvents(count: number, opts: { attack?: boolean } = {}): LogEventInput[] {
  const events: LogEventInput[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const t = rand(TEMPLATES);
    const ctx: Ctx = {
      ip: randIp(),
      user: rand(USERS),
      host: rand(HOSTS),
      port: 1024 + Math.floor(Math.random() * 60000),
    };
    events.push({
      timestamp: new Date(now - Math.floor(Math.random() * 3 * 3600_000)).toISOString(),
      source_type: t.source_type,
      source_ip: ctx.ip,
      event_type: t.event_type,
      severity: t.severity,
      raw_message: `[TEST DATA] ${t.message(ctx)}`,
      user: ctx.user,
      host: ctx.host,
      category: t.category,
      vendor: t.vendor,
      device_type: t.device_type,
      is_demo: true,
      parsed_fields: { generated: true, demo: true, template: t.event_type },
    });
  }
  if (opts.attack) events.push(...generateAttackBurst());
  return events;
}

/** A deterministic brute-force burst that will trigger the built-in rules. */
export function generateAttackBurst(): LogEventInput[] {
  const ip = "203.0.113.77";
  const user = "administrator";
  const host = "dc01";
  const now = Date.now();
  const out: LogEventInput[] = [];
  for (let i = 0; i < 14; i++) {
    out.push({
      timestamp: new Date(now - (14 - i) * 5000).toISOString(),
      source_type: "windows",
      source_ip: ip,
      event_type: "failed_login",
      severity: "medium",
      raw_message: `[TEST DATA] EventID 4625 Failed password for ${user} from ${ip} port ${2000 + i} ssh2`,
      user, host, category: "authentication",
      vendor: "Microsoft", device_type: "server",
      is_demo: true,
      parsed_fields: { generated: true, demo: true, scenario: "brute_force" },
    });
  }
  out.push({
    timestamp: new Date(now).toISOString(),
    source_type: "windows",
    source_ip: ip,
    event_type: "successful_login",
    severity: "info",
    raw_message: `[TEST DATA] Accepted password for ${user} from ${ip} port 2099 ssh2`,
    user, host, category: "authentication",
    vendor: "Microsoft", device_type: "server",
    is_demo: true,
    parsed_fields: { generated: true, demo: true, scenario: "account_takeover" },
  });
  return out;
}