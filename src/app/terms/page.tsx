export const metadata = {
  title: "Terms of Service | Rom's Cinema",
  description: "Terms of Service and Conditions for using Rom's Cinema platform.",
};

export default function TermsPage() {
  const adminEmail = process.env.ADMIN_EMAIL || "";

  return (
    <div className="mx-auto max-w-4xl px-[4vw] py-24 text-slate-300">
      {/* 中文版 */}
      <h1 className="mb-4 text-2xl font-black text-white sm:text-4xl">服务条款</h1>
      <p className="mb-8 text-xs text-slate-500">最后更新时间: {new Date().toLocaleDateString('zh-CN')}</p>

      <div className="space-y-6 text-sm leading-relaxed sm:text-base mb-16">
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">1. 接受条款</h2>
          <p>
            访问或使用 Rom&apos;s Cinema（“服务”、“我们”或“我们的”），即表示您同意受本服务条款的约束。如果您不同意条款的任何部分，则不得访问该服务。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">2. 服务描述</h2>
          <p>
            Rom&apos;s Cinema 是一个提供数字视频内容供流式传输和观看的视频点播 (VOD) 平台。我们保留在不另行通知的情况下，自行决定撤销或修改我们的服务以及我们提供的任何服务或材料的权利。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">3. 用户账号</h2>
          <p>
            当您在我们这里创建账户时，您必须提供准确、完整且最新的信息。否则将构成对条款的违反，可能导致您在我们服务上的账户被立即停用。您有责任妥善保管用于访问服务的密码。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">4. 知识产权</h2>
          <p>
            本服务及其原始内容、功能和特性均为 Rom&apos;s Cinema 及其许可方的独家财产。本服务受版权、商标和其他法律的保护。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">5. 可接受的使用</h2>
          <p>
            您同意不以任何违反任何适用的国家或国际法律法规的方式使用服务，亦不以剥削、伤害或试图剥削或伤害未成年人为目的。您不得试图绕过本服务使用的任何地理限制或数字版权管理 (DRM) 技术。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">6. 定价与支付</h2>
          <p>
            所有价格均在我们网站上标明，并可能发生变化。付款处理服务由第三方支付网关（如 Stripe）提供，并受其各自条款和条件的约束。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">7. 管辖法律</h2>
          <p>
            本条款应受法律管辖并根据法律进行解释，而不考虑其法律冲突条款。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">8. 联系我们</h2>
          <p>
            如果您对本条款有任何疑问，请联系我们：{" "}
            <a href={`mailto:${adminEmail}`} className="text-amber-500 hover:underline">
              {adminEmail}
            </a>
          </p>
        </section>
      </div>

      <hr className="border-white/5 my-12" />

      {/* English Version */}
      <h1 className="mb-4 text-2xl font-black text-white sm:text-4xl">Terms of Service</h1>
      <p className="mb-8 text-xs text-slate-500">Last updated: {new Date().toLocaleDateString('en-US')}</p>

      <div className="space-y-6 text-sm leading-relaxed sm:text-base">
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Rom&apos;s Cinema (&quot;Service&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">2. Service Description</h2>
          <p>
            Rom&apos;s Cinema is a Video on Demand (VOD) platform providing digital video content for streaming and viewing. We reserve the right to withdraw or amend our service, and any service or material we provide, in our sole discretion without notice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">3. User Accounts</h2>
          <p>
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service. You are responsible for safeguarding the password that you use to access the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">4. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are and will remain the exclusive property of Rom&apos;s Cinema and its licensors. The Service is protected by copyright, trademark, and other laws.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">5. Acceptable Use</h2>
          <p>
            You agree not to use the Service in any way that violates any applicable national or international law or regulation, or for the purpose of exploiting, harming, or attempting to exploit or harm minors in any way. You must not attempt to circumvent any geographical restrictions or digital rights management (DRM) technologies used by the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">6. Pricing and Payments</h2>
          <p>
            All prices are stated on our website and are subject to change. Payment processing services are provided by third-party payment gateways (e.g., Stripe) and are subject to their respective terms and conditions.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">7. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws, without regard to its conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-white">8. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:{" "}
            <a href={`mailto:${adminEmail}`} className="text-amber-500 hover:underline">
              {adminEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
