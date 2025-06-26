import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream
    );
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  if (isStandalone) {
    return null; // Don't show install button if already installed
  }

  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <h3>Install App</h3>
      <button
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          background: "#10b981",
          color: "white",
          border: "none",
          fontWeight: "bold",
        }}
      >
        Add to Home Screen
      </button>
      {isIOS && (
        <p style={{ marginTop: "1rem" }}>
          To install this app on your iOS device, tap the share button
          <span role="img" aria-label="share icon">
            {" "}
            ⎋{" "}
          </span>
          and then &quot;Add to Home Screen&quot;
          <span role="img" aria-label="plus icon">
            {" "}
            ➕{" "}
          </span>
          .
        </p>
      )}
    </div>
  );
}
