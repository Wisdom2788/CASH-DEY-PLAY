export const getTimeMessage = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Top of the morning to you! 🌻";
  if (hour < 18) return "Hope your day's going great ☀️";
  return "Here's to a calm evening 🌙";
};