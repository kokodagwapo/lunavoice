import type { CSSProperties } from "react";
import type { MouthShape, LunaMood } from "../lib/realtime";
import lunaAvatar from "../assets/luna-avatar.png";

type LunaFaceProps = {
  mood: LunaMood;
  mouthShape: MouthShape;
};

export function LunaFace({ mood, mouthShape }: LunaFaceProps) {
  const getMoodOverlay = () => {
    switch (mood) {
      case "listening":
        return "luna-overlay-listening";
      case "speaking":
        return "luna-overlay-speaking";
      case "thinking":
      case "working":
        return "luna-overlay-thinking";
      case "error":
        return "luna-overlay-error";
      default:
        return "";
    }
  };

  const speakingIntensity = mood === "speaking" ? mouthShape.open : 0;

  return (
    <div
      className={`luna-face luna-face-${mood} ${getMoodOverlay()}`}
      style={
        {
          "--speaking-intensity": speakingIntensity.toFixed(3),
          "--mouth-open": mouthShape.open.toFixed(3),
        } as CSSProperties
      }
      aria-label={`Luna mood: ${mood}`}
    >
      <div className="luna-avatar-container">
        <img
          src={lunaAvatar}
          alt="Luna"
          className="luna-avatar-image"
          draggable={false}
        />
        <div className="luna-mood-glow" />
      </div>
    </div>
  );
}
