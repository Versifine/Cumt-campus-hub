package auth

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"net/url"
	"os"
	"reflect"
	"strconv"
	"strings"
)

type EmailSender interface {
	SendVerificationEmail(toEmail, token string) error
}

func IsNilEmailSender(sender EmailSender) bool {
	if sender == nil {
		return true
	}
	value := reflect.ValueOf(sender)
	switch value.Kind() {
	case reflect.Ptr, reflect.Interface, reflect.Slice, reflect.Map, reflect.Func, reflect.Chan:
		return value.IsNil()
	default:
		return false
	}
}

type SMTPMailer struct {
	Host           string
	Port           int
	Username       string
	Password       string
	From           string
	AppBaseURL     string
	UseImplicitTLS bool
}

func NewSMTPMailerFromEnv() (*SMTPMailer, error) {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	if host == "" {
		return nil, fmt.Errorf("SMTP_HOST is required")
	}
	port := 587
	if rawPort := strings.TrimSpace(os.Getenv("SMTP_PORT")); rawPort != "" {
		parsed, err := strconv.Atoi(rawPort)
		if err != nil {
			return nil, fmt.Errorf("invalid SMTP_PORT: %w", err)
		}
		port = parsed
	}
	username := strings.TrimSpace(os.Getenv("SMTP_USER"))
	password := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = username
	}
	if from == "" {
		return nil, fmt.Errorf("SMTP_FROM or SMTP_USER is required")
	}
	appBaseURL := strings.TrimSpace(os.Getenv("APP_BASE_URL"))
	if appBaseURL == "" {
		appBaseURL = "http://localhost:5173"
	}
	useImplicitTLS := strings.EqualFold(strings.TrimSpace(os.Getenv("SMTP_TLS")), "implicit") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("SMTP_TLS")), "ssl") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("SMTP_TLS")), "true")

	return &SMTPMailer{
		Host:           host,
		Port:           port,
		Username:       username,
		Password:       password,
		From:           from,
		AppBaseURL:     appBaseURL,
		UseImplicitTLS: useImplicitTLS,
	}, nil
}

func (m *SMTPMailer) SendVerificationEmail(toEmail, token string) error {
	verifyURL := m.verificationURL(token)
	subject := "Verify your email"
	plainBody := fmt.Sprintf("请通过下面的链接验证邮箱：\n\n%s\n\n该链接 24 小时内有效。\n如果不是你本人操作，请忽略此邮件。", verifyURL)
	htmlBody := buildVerificationHTML(verifyURL)
	message := buildMessage(m.From, toEmail, subject, plainBody, htmlBody)
	return m.sendMail(toEmail, []byte(message))
}

func (m *SMTPMailer) verificationURL(token string) string {
	base := strings.TrimRight(m.AppBaseURL, "/")
	encoded := url.QueryEscape(token)
	return fmt.Sprintf("%s/verify-email?token=%s", base, encoded)
}

func buildMessage(from, to, subject, plainBody, htmlBody string) string {
	boundary := randomBoundary()
	headers := []string{
		fmt.Sprintf("From: %s", from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		fmt.Sprintf("Content-Type: multipart/alternative; boundary=%s", boundary),
	}

	var builder strings.Builder
	builder.WriteString(strings.Join(headers, "\r\n"))
	builder.WriteString("\r\n\r\n")
	builder.WriteString("--")
	builder.WriteString(boundary)
	builder.WriteString("\r\n")
	builder.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	builder.WriteString(plainBody)
	builder.WriteString("\r\n\r\n")
	builder.WriteString("--")
	builder.WriteString(boundary)
	builder.WriteString("\r\n")
	builder.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	builder.WriteString(htmlBody)
	builder.WriteString("\r\n\r\n--")
	builder.WriteString(boundary)
	builder.WriteString("--")
	return builder.String()
}

func randomBoundary() string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "boundary_fallback"
	}
	return "boundary_" + hex.EncodeToString(b[:])
}

func buildVerificationHTML(verifyURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f4f2;font-family:'Noto Sans SC','Segoe UI',Arial,sans-serif;color:#1f1f1f;">
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <div style="font-size:12px;letter-spacing:0.2em;color:#c55f24;font-weight:600;">CAMPUS HUB</div>
                <h1 style="margin:16px 0 8px;font-size:24px;">验证你的邮箱</h1>
                <p style="margin:0 0 20px;line-height:1.6;color:#4a4a4a;">感谢注册！请点击下方按钮完成邮箱验证。</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 28px;">
                <a href="%s" style="display:inline-block;padding:12px 24px;background:#c55f24;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">验证邮箱</a>
                <div style="margin-top:16px;font-size:13px;color:#7a7a7a;">该链接 24 小时内有效。</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="font-size:13px;color:#7a7a7a;line-height:1.6;">如果按钮无法点击，请复制以下链接到浏览器打开：</div>
                <div style="margin-top:8px;word-break:break-all;font-size:12px;color:#c55f24;">%s</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f8f6f3;color:#9a9a9a;font-size:12px;line-height:1.6;">
                如果不是你本人操作，请忽略此邮件。
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, verifyURL, verifyURL)
}

func (m *SMTPMailer) sendMail(to string, message []byte) error {
	address := fmt.Sprintf("%s:%d", m.Host, m.Port)
	if m.UseImplicitTLS {
		return m.sendMailImplicitTLS(address, to, message)
	}

	conn, err := net.Dial("tcp", address)
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{ServerName: m.Host}
		if err := client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if m.Username != "" {
		auth := smtp.PlainAuth("", m.Username, m.Password, m.Host)
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(m.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func (m *SMTPMailer) sendMailImplicitTLS(address, to string, message []byte) error {
	conn, err := tls.Dial("tcp", address, &tls.Config{ServerName: m.Host})
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		return err
	}
	defer client.Close()

	if m.Username != "" {
		auth := smtp.PlainAuth("", m.Username, m.Password, m.Host)
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(m.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
