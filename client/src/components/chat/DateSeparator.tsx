/**
 * DateSeparator — Date pill between message groups
 * Extracted from WhatsAppChat.tsx lines 1004-1016
 */

import { memo } from "react";

const DateSeparator = memo(({ date }: { date: string }) => (
  <div className="flex justify-center my-[12px]">
    <span className="text-[12.5px] px-[12px] py-[5px] rounded-[10px] font-normal uppercase tracking-[0.3px] inbox-date-glass" style={{
      backgroundColor: 'var(--wa-date-pill)',
      color: 'var(--wa-date-pill-text)',
      boxShadow: '0 1px 0.5px var(--wa-msg-shadow)',
    }}>
      {date}
    </span>
  </div>
));
DateSeparator.displayName = "DateSeparator";

export default DateSeparator;
