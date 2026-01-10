import React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

const VerificationEmail = ({ verificationCode, verificationLink }) => {
  return (
    <Html>
      <Head />
      <Preview>Xác thực địa chỉ email của bạn</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Xác thực Email</Heading>
          <Text style={paragraph}>
            Cảm ơn bạn đã đăng ký tài khoản! Để hoàn tất quá trình đăng ký, vui
            lòng xác thực địa chỉ email của bạn bằng cách nhập mã xác thực dưới
            đây:
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{verificationCode}</Text>
          </Section>
          <Text style={paragraph}>
            Hoặc nhấp vào nút bên dưới để xác thực ngay lập tức:
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationLink}>
              Xác thực ngay
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này. Mã xác thực
            sẽ hết hạn sau 10 phút.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  borderRadius: "5px",
  maxWidth: "600px",
};

const heading = {
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center",
  margin: "30px 0",
  color: "#333",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#555",
};

const codeBox = {
  background: "rgba(0,0,0,0.05)",
  borderRadius: "4px",
  border: "1px solid rgba(0,0,0,0.1)",
  margin: "20px 0",
  padding: "10px",
  textAlign: "center",
};

const codeText = {
  color: "#E53935",
  fontSize: "32px",
  fontWeight: "bold",
  letterSpacing: "5px",
  fontFamily: "monospace",
  margin: "10px 0",
};

const buttonContainer = {
  textAlign: "center",
  margin: "30px 0",
};

const button = {
  backgroundColor: "#E53935",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  padding: "12px 30px",
  display: "inline-block",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default VerificationEmail;
