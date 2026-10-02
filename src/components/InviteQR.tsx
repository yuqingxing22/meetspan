import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Icon from "./Icon";
import { t } from "../lib/i18n";

/**
 * QR code for the invite link, e.g. to show on a slide or let someone across
 * the table scan it. Rendered to a canvas so it can be saved as a PNG.
 */
export default function InviteQR({ url, title, compact }: { url: string; title?: string; compact?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);

  function download() {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    const base = (title || "meetspan-invite")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    a.download = `${base || "meetspan-invite"}-qr.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  if (compact) {
    // Small, next to the invite link: the code with a download button under it.
    return (
      <div className="qr-compact">
        <div className="qr-code" ref={wrap}>
          <QRCodeCanvas
            value={url}
            size={104}
            marginSize={2}
            fgColor="#14151A"
            bgColor="#FFFFFF"
            level="M"
            title={t("QR code for the invite link")}
          />
        </div>
        <button type="button" className="qr-download" onClick={download}>
          <Icon name="download" size={14} /> {t("Download QR code")}
        </button>
      </div>
    );
  }

  return (
    <div className="qr-box">
      <div className="qr-code" ref={wrap}>
        <QRCodeCanvas
          value={url}
          size={176}
          marginSize={2}
          fgColor="#14151A"
          bgColor="#FFFFFF"
          level="M"
          title={t("QR code for the invite link")}
        />
      </div>
      <div className="qr-side">
        <p>{t("Scan to open the invite on a phone. Handy for a slide, a printout or someone in the room.")}</p>
        <button type="button" className="btn btn-sm" onClick={download}>
          <Icon name="download" /> {t("Download PNG")}
        </button>
      </div>
    </div>
  );
}
