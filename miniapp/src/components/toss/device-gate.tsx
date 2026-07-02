/**
 * device-gate.tsx — 앱인토스 deviceId 보조 매핑.
 *
 * raw deviceId 는 서버로 1회 전송하고, 서버는 HMAC 해시만 저장한다.
 * 실패해도 앱 사용을 막지 않는다.
 */

import { useEffect, useRef } from 'react';
import { getDeviceId } from '@apps-in-toss/web-framework';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';

export function TossDeviceGate() {
  const { token, isAuthed } = useAuth();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isAuthed || !token || requestedRef.current) return;
    requestedRef.current = true;

    let deviceId: string;
    try {
      deviceId = getDeviceId();
    } catch (error) {
      console.warn('[toss-device] getDeviceId failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      requestedRef.current = false;
      return;
    }

    if (!deviceId) {
      requestedRef.current = false;
      return;
    }

    void apiFetch('/api/toss/device', {
      method: 'POST',
      token,
      body: { deviceId },
    }).catch((error) => {
      console.warn('[toss-device] register failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      requestedRef.current = false;
    });
  }, [isAuthed, token]);

  return null;
}
