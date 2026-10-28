// Types for static image imports (e.g. the candles photo on /molitev). Next adds the same
// reference in next-env.d.ts, but that file is generated and not committed, so CI's
// typecheck (which runs before any build) would not see it.
/// <reference types="next/image-types/global" />
