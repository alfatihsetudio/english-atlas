import AgoraRTC from "agora-rtc-sdk-ng";

// Inisialisasi client hanya di lingkungan browser (menghindari error SSR "window is not defined")
const agoraClient = typeof window !== 'undefined' 
  ? AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }) 
  : null as any;

export default agoraClient;
