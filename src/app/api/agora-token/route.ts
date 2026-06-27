import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelName, uid } = body;

    if (!channelName) {
      return NextResponse.json({ error: 'channelName is required' }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: 'Agora credentials missing. Make sure AGORA_APP_CERTIFICATE is in .env.local' }, { status: 500 });
    }

    // Token expires in 2 hours
    const expirationTimeInSeconds = 7200;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    // Parse UID - default to 0 if not provided (0 = Agora assigns UID automatically)
    let numericUid = 0;
    if (uid !== undefined && uid !== null) {
      numericUid = parseInt(uid, 10);
      if (isNaN(numericUid)) numericUid = 0;
    }

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds,
      privilegeExpiredTs
    );

    return NextResponse.json({ token, uid: numericUid });
  } catch (error: any) {
    console.error('Error generating token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
