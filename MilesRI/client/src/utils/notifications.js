export async function showEarningsNotification(stock, reportDate) {
    if (!("Notification" in window)) return;
  
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
  
    const today = new Date().toISOString().split("T")[0];
    const diff = (new Date(reportDate) - new Date(today)) / (1000 * 3600 * 24);
  
    if (diff <= 1 && diff >= 0) {
      new Notification("📢 财报提醒", {
        body: `${stock} 将于 ${reportDate} 公布财报，建议关注走势！`,
        icon: "/icons/earnings.png",
      });
    }
  }
  