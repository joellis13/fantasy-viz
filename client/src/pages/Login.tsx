import React from "react";

export default function Login() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <p>Click the button to connect your Yahoo account and grant access to your fantasy data.</p>
      <a href="/auth/yahoo/login">
        <button>Connect Yahoo</button>
      </a>
    </div>
  );
}