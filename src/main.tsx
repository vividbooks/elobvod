
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { AuthGate } from "./app/components/auth/AuthGate.tsx";
import App from "./app/App.tsx";
import "@mantine/core/styles.css";
import "./styles/index.css";

const theme = createTheme({
  primaryColor: "blue",
  radius: { md: "12px", lg: "16px" },
  fontFamily: "'Fenomen Sans', ui-sans-serif, system-ui, sans-serif",
});

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme} defaultColorScheme="light">
    <AuthGate>
      <App />
    </AuthGate>
  </MantineProvider>
);
  