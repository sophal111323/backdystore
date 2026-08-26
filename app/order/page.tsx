// Server component - keeps server-only code (prisma/env via Footer) out of the client bundle.
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OrderTracker from "./OrderTracker";

export default function OrderPage() {
  return (
    <>
      <Header />
      <OrderTracker />
      <Footer />
    </>
  );
}
