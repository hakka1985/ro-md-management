import { WishlistForm } from "./WishlistForm";
import { WishlistList } from "./WishlistList";
import { EventPrepPanel } from "./EventPrepPanel";

export function WishlistPage() {
  return (
    <div className="page">
      <WishlistForm />
      <EventPrepPanel />
      <WishlistList />
    </div>
  );
}
