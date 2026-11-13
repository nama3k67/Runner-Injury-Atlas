import type { ReviewBadge as Badge } from '@atlas/contracts';
import { useEffect, useState } from 'react';
import { getReviewBadge } from '../api';

/**
 * Shows whether THIS exact content was approved by a professional.
 * If the API is unreachable the page stays honest and says "not reviewed".
 */
export function ReviewBadge({
  injurySlug,
  contentHash,
}: {
  injurySlug: string;
  contentHash: string;
}) {
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    let alive = true;
    getReviewBadge(injurySlug, contentHash)
      .then((b) => alive && setBadge(b))
      .catch(() => alive && setBadge(null));
    return () => {
      alive = false;
    };
  }, [injurySlug, contentHash]);

  if (badge?.reviewed) {
    return (
      <p className="badge badge-ok" data-testid="review-badge">
        Đã được duyệt chuyên môn bởi {badge.reviewerName}, {badge.reviewerTitle}
        {badge.decidedAt ? ` (${badge.decidedAt.slice(0, 10)})` : ''}
      </p>
    );
  }
  return (
    <p className="badge badge-warn" data-testid="review-badge">
      Bản nháp: nội dung chưa được chuyên gia y khoa duyệt. Không dùng thay cho việc đi khám.
    </p>
  );
}
