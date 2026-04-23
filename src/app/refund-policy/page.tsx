export const metadata = {
  title: "Refund Policy | Rom's Cinema",
  description: "Refund and Dispute Policy for Rom's Cinema Video on Demand services.",
};

export default function RefundPolicyPage() {
  const adminEmail = process.env.ADMIN_EMAIL || "";

  return (
    <div className="mx-auto max-w-4xl px-[4vw] py-24 text-slate-300">
      {/* 中文版 */}
      <h1 className="mb-4 text-2xl font-black text-white sm:text-4xl">退款与争议政策</h1>
      <p className="mb-8 text-xs text-slate-500">最后更新时间: {new Date().toLocaleDateString('zh-CN')}</p>

      <div className="space-y-6 text-sm leading-relaxed sm:text-base mb-16">
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">1. 数字内容退货政策</h2>
          <p>
            Rom&apos;s Cinema 提供数字虚拟商品和视频点播 (VOD) 服务。由于此类服务的即时性、数字化和不可收回的性质，<strong>一旦您访问了数字内容，所有销售均为最终销售，不予退款</strong>。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">2. 不支持退款</h2>
          <p>
            一旦您的账户获得了视频内容的观看权限，或一旦视频开始播放，我们不提供任何购买、订阅或按次付费交易的退款或积分。在我们的平台进行购买，即表示您承认并同意此不退款政策。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">3. 特殊情况</h2>
          <p>
            如果我方发生记录在案的技术故障，导致您在较长时间内无法访问所购买的内容，我们可酌情提供退款或积分。因用户端原因（如设备不兼容或网速不足）导致的问题不符合退款条件。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">4. 争议与拒付</h2>
          <p>
            如果您遇到任何账单问题，必须先联系我们的客服团队寻求解决。在未事先沟通的情况下发起无理拒付或付款争议，可能导致您的账户被立即暂停或永久停用。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">5. 联系客服寻求帮助</h2>
          <p>
            如果您认为账单有误，或在访问购买的内容时遇到严重的技术问题，请立即联系我们的支持团队：{" "}
            <a href={`mailto:${adminEmail}`} className="text-amber-500 hover:underline">
              {adminEmail}
            </a>
          </p>
        </section>
      </div>

      <hr className="border-white/5 my-12" />

      {/* English Version */}
      <h1 className="mb-4 text-2xl font-black text-white sm:text-4xl">Refund & Dispute Policy</h1>
      <p className="mb-8 text-xs text-slate-500">Last updated: {new Date().toLocaleDateString('en-US')}</p>

      <div className="space-y-6 text-sm leading-relaxed sm:text-base">
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">1. Digital Content Return Policy</h2>
          <p>
            Rom&apos;s Cinema provides digital virtual goods and Video on Demand (VOD) services. Due to the immediate, digital, and irrecoverable nature of these services, <strong>all sales are final and non-refundable</strong> once the digital content has been accessed.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">2. No Refunds Allowed</h2>
          <p>
            We do not offer refunds or credits for any purchases, subscriptions, or pay-per-view transactions once your account has been granted access to the video content, or once playback has commenced. By making a purchase on our platform, you acknowledge and agree to this no-refund policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">3. Exceptional Circumstances</h2>
          <p>
            We may, at our sole discretion, issue a refund or credit in the event of documented technical failures on our end that entirely prevent you from accessing the purchased content for an extended period. User-side issues, such as incompatible devices or insufficient internet bandwidth, do not qualify for refunds.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">4. Disputes and Chargebacks</h2>
          <p>
            If you encounter any billing issues, we require you to contact our customer support team first to seek a resolution. Unwarranted chargebacks or payment disputes filed without prior communication may result in immediate suspension or permanent termination of your account.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">5. Contact Us for Assistance</h2>
          <p>
            If you believe you have been billed in error or face a severe technical issue accessing your purchased content, please reach out to our support team immediately at:{" "}
            <a href={`mailto:${adminEmail}`} className="text-amber-500 hover:underline">
              {adminEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
