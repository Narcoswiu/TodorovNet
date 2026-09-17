/** Who runs this installation. Set both before going live: the privacy page names them as the contact. */
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "TodorovNET",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};
