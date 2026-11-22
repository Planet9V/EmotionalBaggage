// A small SMTP server for tests (Admin, Email and the new sign-in's mail): greets, answers EHLO (with AUTH PLAIN),
// AUTH, MAIL, RCPT, DATA and QUIT. No TLS. Each message's lines are kept in `messages`.
import { createServer as tcpServer, type AddressInfo, type Server as TcpServer, type Socket } from "node:net";

export function smtpStandIn(password: string): Promise<{ port: number; messages: string[]; close: () => Promise<void> }> {
  const messages: string[] = [];
  const srv: TcpServer = tcpServer((sock: Socket) => {
    let data = false;
    let buf = "";
    let msg = "";
    sock.write("220 standin ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") {
            data = false;
            messages.push(msg);
            msg = "";
            sock.write("250 queued\r\n");
          } else msg += line + "\n";
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) sock.write("250-standin\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) {
          const decoded = Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8").split("\u0000");
          sock.write(decoded[2] === password ? "235 ok\r\n" : "535 bad credentials\r\n");
        } else if (cmd.startsWith("MAIL") || cmd.startsWith("RCPT") || cmd.startsWith("RSET") || cmd.startsWith("NOOP")) sock.write("250 ok\r\n");
        else if (cmd === "DATA") {
          data = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") {
          sock.write("221 bye\r\n");
          sock.end();
        } else sock.write("502 no\r\n");
      }
    });
    sock.on("error", () => undefined);
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ port: (srv.address() as AddressInfo).port, messages, close: () => new Promise((r) => srv.close(() => r())) })));
}

