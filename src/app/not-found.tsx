import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-base font-semibold text-foreground mb-2">페이지를 찾을 수 없어요.</p>
      <p className="text-sm text-muted-foreground mb-6">주소를 다시 확인해주세요.</p>
      <Link href="/feed">
        <Button variant="default">피드로 돌아가기</Button>
      </Link>
    </div>
  );
}
