import { WishlistForm } from "./WishlistForm";
import { WishlistList } from "./WishlistList";

export function WishlistPage() {
  return (
    <div className="page">
      <WishlistForm />
      <WishlistList />
    </div>
  );
}
