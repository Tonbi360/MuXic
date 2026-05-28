export function getUserId(): string {
  let userId = localStorage.getItem("muxic_userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("muxic_userId", userId);
  }
  return userId;
}
