// Server component - keeps server-only code (prisma/env via Footer) out of the client bundle.
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckoutClient from "./CheckoutClient";

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <CheckoutClient />
      <Footer />
    </>
  );
}
