import { LoadingMark } from "@/components/LoadingMark";

// Shown while a page outside the panel (sign-in, setup) loads.
export default function Loading() {
  return <main className="loading-page"><LoadingMark /></main>;
}
