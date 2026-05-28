export function getUserId(): string {
  let userId = localStorage.getItem("soundboard_userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("soundboard_userId", userId);
  }
  return userId;
}
