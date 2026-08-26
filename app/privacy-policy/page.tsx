import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "គោលការណ៍ឯកជនភាព — JASMINTOPUP",
  description:
    "គោលការណ៍ឯកជនភាពរបស់ JASMINTOPUP ពន្យល់ពីរបៀបប្រមូល ប្រើប្រាស់ និងការពារព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក។",
};

const LAST_UPDATED = "១៥ ឧសភា ២០២៦";

const sections = [
  {
    id: "s1",
    num: "១",
    title: "សេចក្តីផ្តើម",
    content: (
      <p>
        JASMINTOPUP (<a href="https://www.jasmintopup.site" className="text-pink-600 hover:underline font-semibold">www.jasmintopup.site</a>)
        គឺជា platform សម្រាប់បញ្ចូល diamonds, coins, Robux និង game credits ផ្សេងៗ
        ស្ថិតនៅក្នុងប្រទេសកម្ពុជា។ គោលការណ៍ឯកជនភាពនេះ ពន្យល់ពីរបៀបដែលយើង
        ប្រមូល រក្សា ប្រើប្រាស់ និងការពារព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក នៅពេល
        អ្នកចូលទស្សនា ឬប្រើប្រាស់សេវាកម្មរបស់យើង។ យើងប្តេជ្ញាគោរព
        ភាពឯកជនរបស់អ្នកគ្រប់ពេល។
      </p>
    ),
  },
  {
    id: "s2",
    num: "២",
    title: "ការយល់ព្រម",
    content: (
      <>
        <p>
          តាមរយៈការចូលទស្សនា ឬប្រើប្រាស់ website របស់យើង អ្នកយល់ព្រមថា
          បានអាន យល់ ហើយព្រមទទួលគោលការណ៍ឯកជនភាពនេះ។
        </p>
        <div className="mt-3 rounded-xl border-l-4 border-pink-400 bg-pink-50 px-4 py-3 text-sm text-pink-800">
          ប្រសិនបើអ្នក <strong>មិនយល់ព្រម</strong> នឹងគោលការណ៍នេះ
          សូមមេត្តាបញ្ឈប់ការប្រើប្រាស់ website ហើយកុំបញ្ជូនព័ត៌មានផ្ទាល់ខ្លួន
          ណាមួយមកកាន់យើង។
        </div>
      </>
    ),
  },
  {
    id: "s3",
    num: "៣",
    title: "ព័ត៌មានដែលយើងប្រមូល",
    content: (
      <>
        <p className="font-semibold text-pink-800 mb-2">ក. ព័ត៌មានដែលអ្នកផ្ដល់ដោយផ្ទាល់</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-pink-100">
                <th className="text-left px-4 py-2 text-pink-900 font-semibold rounded-tl-lg">ប្រភេទព័ត៌មាន</th>
                <th className="text-left px-4 py-2 text-pink-900 font-semibold rounded-tr-lg">ឧទាហរណ៍</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100">
              {[
                ["ព័ត៌មានទំនាក់ទំនង", "ឈ្មោះ, អ៊ីមែល, លេខទូរស័ព្ទ"],
                ["ព័ត៌មានគណនី Game", "Game UID, Server ID, Player Name"],
                ["ព័ត៌មានការបញ្ជាទិញ", "Order ID, ចំនួន, ប្រភេទ package"],
                ["ព័ត៌មានការបង់ប្រាក់", "Payment proof, Transaction ID, KHQR reference"],
                ["សារ Support", "សំណួរ, ពាក្យបណ្តឹង, ការសន្ទនាជំនួយ"],
              ].map(([type, example]) => (
                <tr key={type} className="hover:bg-pink-50">
                  <td className="px-4 py-2 text-pink-700 font-medium">{type}</td>
                  <td className="px-4 py-2 text-pink-600">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-semibold text-pink-800 mb-2">ខ. ព័ត៌មានដែលប្រមូលដោយស្វ័យប្រវត្តិ</p>
        <ul className="list-disc list-inside space-y-1 text-pink-700 text-sm">
          <li>IP address និងទីតាំងប្រហាក់ប្រហែល</li>
          <li>ប្រភេទ browser, ប្រព័ន្ធប្រតិបត្តិការ, និងឧបករណ៍</li>
          <li>ព័ត៌មាន cookies និង session</li>
          <li>ទំព័រដែលបានចូលមើល និងពេលវេលានៃការទស្សនា</li>
        </ul>
      </>
    ),
  },
  {
    id: "s4",
    num: "៤",
    title: "របៀបដែលយើងប្រើព័ត៌មាន",
    content: (
      <>
        <p className="mb-2">ព័ត៌មានរបស់អ្នកត្រូវបានប្រើប្រាស់ក្នុងគោលបំណងខាងក្រោម:</p>
        <ul className="list-disc list-inside space-y-1.5 text-pink-700 text-sm">
          <li>ដំណើរការ និងបញ្ចប់ការបញ្ជាទិញ top-up របស់អ្នក</li>
          <li>ផ្ទៀងផ្ទាត់ការបង់ប្រាក់ និងបញ្ជាក់ transaction</li>
          <li>ផ្ញើការជូនដំណឹង order status ទៅអ្នក</li>
          <li>ផ្ដល់ customer support និងដោះស្រាយបញ្ហា</li>
          <li>ការពារការក្លែងបន្លំ (fraud) និងសកម្មភាពមិនស្របច្បាប់</li>
          <li>វិភាគ និងកែលម្អប្រសិទ្ធភាព website</li>
          <li>ទំនាក់ទំនងពី promotions ឬការផ្លាស់ប្ដូរ (ប្រសិនបើអ្នកបានព្រម)</li>
        </ul>
      </>
    ),
  },
  {
    id: "s5",
    num: "៥",
    title: "ព័ត៌មានការបង់ប្រាក់ និងការបញ្ជាទិញ",
    content: (
      <>
        <p className="mb-3">
          ការទូទាត់នៅ JASMINTOPUP ដំណើរការតាម <strong className="text-pink-700">KHQR</strong>{" "}
          ដែលជាវិធីបង់ប្រាក់ស្ដង់ដាររបស់ប្រទេសកម្ពុជា។ យើងទទួលបានតែ
          Transaction Reference ID និងរូបភាព payment proof ប៉ុណ្ណោះ
          ដើម្បីផ្ទៀងផ្ទាត់ការបង់ប្រាក់។
        </p>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold mb-2">⚠️ យើងមិនដែល និងនឹងមិនស្នើសុំ:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Password ឬ PIN នៃ game account របស់អ្នក</li>
            <li>OTP ពី SMS ធនាគារ ឬ e-wallet</li>
            <li>Password ឬ PIN ការបង់ប្រាក់របស់អ្នក</li>
            <li>ការចូលដោយផ្ទាល់ទៅក្នុង account ណាមួយ</li>
          </ul>
          <p className="mt-2 font-semibold">
            ប្រសិនបើអ្នកទទួលបានសំណើបែបនេះ សូមកុំឆ្លើយតប
            ហើយទំនាក់ទំនងយើងភ្លាមៗ។
          </p>
        </div>
      </>
    ),
  },
  {
    id: "s6",
    num: "៦",
    title: "Log Files",
    content: (
      <p>
        ដូច website ភាគច្រើន JASMINTOPUP ប្រើប្រាស់ log files ស្វ័យប្រវត្តិ
        ដែលរួមមាន IP address, ប្រភេទ browser, Internet Service Provider (ISP),
        កាលបរិច្ឆេទ និងពេលវេលា, ទំព័រ referral និង exit។
        Log ទាំងនេះត្រូវបានប្រើដើម្បីវិភាគ trend, គ្រប់គ្រង website,
        និងប្រមូលស្ថិតិប្រជាសាស្ត្ររួម។
        ព័ត៌មាន log <strong>មិនអាចកំណត់អត្តសញ្ញាណបុគ្គល</strong>ដោយផ្ទាល់ទេ។
      </p>
    ),
  },
  {
    id: "s7",
    num: "៧",
    title: "Cookies",
    content: (
      <>
        <p className="mb-2">
          Cookies គឺជាឯកសារតូចៗដែលរក្សាទុកនៅក្នុង browser ដើម្បីធ្វើឱ្យ
          ការប្រើប្រាស់ website កាន់តែងាយស្រួល។ យើងប្រើ cookies ក្នុងគោលបំណង:
        </p>
        <ul className="list-disc list-inside space-y-1 text-pink-700 text-sm mb-3">
          <li>រក្សាទុក preference ភាសា និងរូបិយប័ណ្ណ (USD/KHR)</li>
          <li>ការពារ session security</li>
          <li>វិភាគចំនួនអ្នកចូលមើល និងទំព័រពេញនិយម</li>
        </ul>
        <p className="text-sm text-pink-600">
          អ្នកអាចបិទ cookies នៅក្នុង browser settings ប៉ុន្តែអាចប៉ះពាល់
          ដល់មុខងារខ្លះនៃ website។
        </p>
      </>
    ),
  },
  {
    id: "s8",
    num: "៨",
    title: "សេវាកម្មភាគីទីបី",
    content: (
      <>
        <p className="mb-3">
          ព័ត៌មានរបស់អ្នក <strong className="text-pink-700">នឹងមិនត្រូវបានលក់ ជួល ឬចែករំលែក</strong>{" "}
          ជាមួយភាគីទីបី លើកលែងតែករណីចាំបាច់ខាងក្រោម:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-pink-100">
                <th className="text-left px-4 py-2 text-pink-900 font-semibold rounded-tl-lg">ភាគីទីបី</th>
                <th className="text-left px-4 py-2 text-pink-900 font-semibold rounded-tr-lg">ហេតុផល</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100">
              {[
                ["Payment Provider (KHQR)", "ផ្ទៀងផ្ទាត់ transaction"],
                ["Top-up Supplier / Game Publisher", "ដំណើរការ UID និង top-up"],
                ["Hosting Provider (Render.com)", "ប្រើប្រាស់ server infrastructure"],
                ["Analytics Tools", "ស្ថិតិ website (anonymous)"],
                ["អាជ្ញាធរតាមច្បាប់", "ករណីចាំបាច់ស្របច្បាប់"],
              ].map(([party, reason]) => (
                <tr key={party} className="hover:bg-pink-50">
                  <td className="px-4 py-2 text-pink-700 font-medium">{party}</td>
                  <td className="px-4 py-2 text-pink-600">{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-pink-600">
          ភាគីទីបីទាំងនេះមានកាតព្វកិច្ចការពារទិន្នន័យ
          ហើយមិនអនុញ្ញាតឱ្យប្រើព័ត៌មានផ្ទាល់ខ្លួនសម្រាប់គោលបំណងផ្ទាល់ខ្លួន
          របស់ពួកគេទេ។
        </p>
      </>
    ),
  },
  {
    id: "s9",
    num: "៩",
    title: "សុវត្ថិភាពទិន្នន័យ",
    content: (
      <>
        <p className="mb-2">
          យើងប្រើវិធានការសុវត្ថិភាពស្ដង់ដារ ដើម្បីការពារព័ត៌មានរបស់អ្នក:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-pink-700 text-sm mb-3">
          <li>ការតភ្ជាប់ HTTPS ដើម្បីការពារទិន្នន័យក្នុងការបញ្ជូន</li>
          <li>ការដាក់កំហិតការចូល database ជាមួយ role-based access</li>
          <li>ការ hash ព័ត៌មានសម្ងាត់</li>
          <li>ការត្រួតពិនិត្យ log សម្រាប់សកម្មភាពគួរឱ្យសង្ស័យ</li>
        </ul>
        <div className="rounded-xl border-l-4 border-pink-400 bg-pink-50 px-4 py-3 text-sm text-pink-800">
          ទោះបីយ៉ាងណា <strong>គ្មាន system ណាដែលសុវត្ថិភាព ១០០%</strong> ទេ។
          យើងណែនាំឱ្យអ្នកជួយការពារខ្លួន ដោយមិនចែករំលែក password
          ចំពោះបុគ្គលណាក៏ដោយ។
        </div>
      </>
    ),
  },
  {
    id: "s10",
    num: "១០",
    title: "រយៈពេលរក្សាទុកទិន្នន័យ",
    content: (
      <>
        <p className="mb-2">យើងរក្សាទុកព័ត៌មានរបស់អ្នកតែក្នុងរយៈពេលចាំបាច់ប៉ុណ្ណោះ:</p>
        <ul className="list-disc list-inside space-y-1.5 text-pink-700 text-sm mb-3">
          <li><strong>ព័ត៌មាន order:</strong> រក្សា ១ ឆ្នាំ ដើម្បីសម្រួល dispute resolution</li>
          <li><strong>Log files:</strong> រក្សា ៩០ ថ្ងៃ</li>
          <li><strong>សារ support:</strong> រក្សា ១ ឆ្នាំ</li>
          <li><strong>Payment proof:</strong> រក្សា ១ ឆ្នាំ ដើម្បី audit</li>
        </ul>
        <p className="text-sm text-pink-600">
          នៅពេលផុតរយៈពេល ទិន្នន័យនឹងត្រូវបានលុបចោល ឬធ្វើ anonymize
          ដើម្បីកុំអាចកំណត់អត្តសញ្ញាណបាន។
        </p>
      </>
    ),
  },
  {
    id: "s11",
    num: "១១",
    title: "សិទ្ធិរបស់អ្នកប្រើប្រាស់",
    content: (
      <>
        <p className="mb-2">អ្នកមានសិទ្ធិទាំងនេះ ទាក់ទងនឹងព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក:</p>
        <ul className="list-disc list-inside space-y-1.5 text-pink-700 text-sm mb-3">
          <li><strong>សិទ្ធិចូលមើល:</strong> ស្នើសុំច្បាប់ចម្លងនៃព័ត៌មានដែលយើងមានអំពីអ្នក</li>
          <li><strong>សិទ្ធិកែតម្រូវ:</strong> ស្នើឱ្យកែព័ត៌មានដែលមិនត្រឹមត្រូវ</li>
          <li><strong>សិទ្ធិលុបចោល:</strong> ស្នើឱ្យលុបទិន្នន័យ (ស្ថានភាពមួយចំនួន)</li>
          <li><strong>សិទ្ធិបដិសេធ:</strong> ប្រឆាំងការប្រើព័ត៌មានសម្រាប់ marketing</li>
        </ul>
        <p className="text-sm text-pink-600">
          ដើម្បីប្រើប្រាស់សិទ្ធិទាំងនេះ សូមទំនាក់ទំនងយើងតាម{" "}
          <a href="mailto:jasmintopup@gmail.com" className="text-pink-700 font-semibold hover:underline">
            jasmintopup@gmail.com
          </a>{" "}
          ហើយយើងនឹងឆ្លើយតបក្នុងរយៈ <strong>៧ ថ្ងៃ</strong>។
        </p>
      </>
    ),
  },
  {
    id: "s12",
    num: "១២",
    title: "ឯកជនភាពកុមារ",
    content: (
      <>
        <p className="mb-2">
          JASMINTOPUP <strong className="text-pink-700">មិនមែនសម្រាប់</strong>
          អ្នកដែលមានអាយុក្រោម ១៨ ឆ្នាំទេ។ យើងមិនដឹងខ្លួន ឬចេតនា
          ប្រមូលព័ត៌មានផ្ទាល់ខ្លួនពីអ្នកមានអាយុក្រោម ១៨ ឆ្នាំឡើយ។
        </p>
        <p className="text-sm text-pink-600">
          ប្រសិនបើអ្នកជាឪពុកម្តាយ ឬអាណាព្យាបាល ហើយដឹងថាកូនអ្នក
          បានផ្ដល់ព័ត៌មានផ្ទាល់ខ្លួន សូមទំនាក់ទំនងយើង
          ដើម្បីឱ្យយើងអាចលុបព័ត៌មាននោះចេញ។
        </p>
      </>
    ),
  },
  {
    id: "s13",
    num: "១៣",
    title: "ការផ្លាស់ប្ដូរ Privacy Policy",
    content: (
      <>
        <p className="mb-2">
          យើងរក្សាសិទ្ធិក្នុងការធ្វើបច្ចុប្បន្នភាពគោលការណ៍ឯកជនភាពនេះ
          នៅពេលណាមួយ។ ការផ្លាស់ប្ដូរសំខាន់ៗ នឹងត្រូវបានជូនដំណឹងតាម:
        </p>
        <ul className="list-disc list-inside space-y-1 text-pink-700 text-sm mb-2">
          <li>ការបង្ហាញ banner ជូនដំណឹងនៅ website</li>
          <li>ការផ្លាស់ប្ដូរ កែប្រែចុងក្រោយ date នៅផ្នែកខាងលើ</li>
        </ul>
        <p className="text-sm text-pink-600">
          ការបន្តប្រើ website ក្រោយការផ្លាស់ប្ដូរ ចាត់ទុកថាអ្នកយល់ព្រម
          នឹងគោលការណ៍ដែលបានធ្វើបច្ចុប្បន្នភាព។
        </p>
      </>
    ),
  },
  {
    id: "s14",
    num: "១៤",
    title: "ទំនាក់ទំនង",
    content: (
      <>
        <p className="mb-4">
          ប្រសិនបើអ្នកមានសំណួរ ឬបញ្ហាទាក់ទងនឹងគោលការណ៍ឯកជនភាពនេះ
          សូមទំនាក់ទំនងយើង:
        </p>
        <div className="rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 space-y-3">
          {[
            { icon: <Image src="/jasmintopup-logo.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />, label: "JASMINTOPUP" },
            { icon: <span aria-hidden="true">🌐</span>, label: <a href="https://www.jasmintopup.site" className="text-pink-700 hover:underline font-medium">www.jasmintopup.site</a> },
            { icon: <span aria-hidden="true">✉️</span>, label: <a href="mailto:jasmintopup@gmail.com" className="text-pink-700 hover:underline font-medium">jasmintopup@gmail.com</a> },
            { icon: <span aria-hidden="true">🇰🇭</span>, label: "ប្រទេសកម្ពុជា" },
          ].map(({ icon, label }, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-base shrink-0">{icon}</span>
              <span className="text-pink-700">{label}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
];

const privacyHighlights = [
  { title: "ទិន្នន័យ Order", value: "ការពារដោយ HTTPS", icon: "🧾" },
  { title: "ការទូទាត់", value: "KHQR / Transaction Ref", icon: "💎" },
  { title: "Support", value: "ឆ្លើយតបក្នុង ៧ ថ្ងៃ", icon: "💬" },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />

      <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fff1f7_0%,#fff7fb_45%,#ffffff_100%)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-pink-300/25 blur-3xl" />
          <div className="absolute right-[-6rem] top-64 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="absolute left-1/2 top-[34rem] h-64 w-64 -translate-x-1/2 rounded-full bg-rose-200/25 blur-3xl" />
          <div className="dot-pattern absolute inset-x-0 top-0 h-[34rem] opacity-40" />
        </div>

        <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="fade-up">
              <div className="inline-flex items-center gap-3 rounded-full border border-pink-200 bg-white/80 px-4 py-2 shadow-sm shadow-pink-100 backdrop-blur-md">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-600">🔒</span>
                <span className="text-xs font-black uppercase tracking-[0.26em] text-pink-500">Privacy Policy</span>
              </div>

              <h1 className="mt-5 max-w-3xl font-display text-4xl font-black leading-tight text-pink-950 sm:text-5xl lg:text-6xl">
                គោលការណ៍ឯកជនភាព
                <span className="mt-2 block bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-400 bg-clip-text text-transparent">
                  JASMINTOPUP
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm font-semibold leading-8 text-pink-800/70 sm:text-base">
                យើងពន្យល់យ៉ាងច្បាស់ពីរបៀបប្រមូល ប្រើប្រាស់ រក្សាទុក និងការពារព័ត៌មានរបស់អ្នក
                ពេលប្រើប្រាស់សេវាកម្ម top-up របស់ JASMINTOPUP។
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-300/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pink-300/60 active:scale-[0.98]"
                >
                  🏠 ត្រឡប់ទៅទំព័រដើម
                </Link>
                <Link
                  href="/order"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-pink-300 bg-white/85 px-5 py-3 text-sm font-black text-pink-600 shadow-sm shadow-pink-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-50 active:scale-[0.98]"
                >
                  🔎 តាមដានការបញ្ជាទិញ
                </Link>
              </div>
            </div>

            <div className="fade-up rounded-[2rem] border border-white/80 bg-white/70 p-5 shadow-2xl shadow-pink-200/40 backdrop-blur-2xl sm:p-6" style={{ animationDelay: "120ms" }}>
              <div className="rounded-[1.6rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50/80 to-white p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] border border-pink-100 bg-white p-2 shadow-lg shadow-pink-200/50">
                    <Image
                      src="/jasmintopup-logo.png"
                      alt="JASMINTOPUP"
                      width={80}
                      height={80}
                      className="h-full w-full object-contain"
                      priority
                    />
                  </span>
                  <div>
                    <p className="text-xl font-black text-pink-950">JASMINTOPUP</p>
                    <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.24em] text-pink-400">Instant · Secure · 24/7</p>
                    <span className="mt-3 inline-flex rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-bold text-pink-600">
                      កែប្រែចុងក្រោយ: {LAST_UPDATED}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {privacyHighlights.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-pink-100 bg-white/80 p-4 shadow-sm shadow-pink-100/70">
                      <div className="text-2xl">{item.icon}</div>
                      <p className="mt-2 text-xs font-black text-pink-900">{item.title}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-pink-500">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto grid max-w-7xl gap-6 px-4 pb-14 pt-4 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[1.7rem] border border-pink-100 bg-white/78 p-4 shadow-xl shadow-pink-100/50 backdrop-blur-2xl">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.26em] text-pink-400">មាតិកា</p>
              <nav className="max-h-[calc(100vh-9rem)] space-y-1 overflow-auto pr-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="group flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-pink-700/70 transition-all duration-300 hover:bg-pink-50 hover:text-pink-600"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-50 text-[11px] font-black text-pink-500 group-hover:bg-pink-100">
                      {s.num}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div>
            <div className="mb-6 rounded-[1.8rem] border border-pink-100 bg-white/75 p-4 shadow-lg shadow-pink-100/40 backdrop-blur-xl lg:hidden">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.26em] text-pink-400">មាតិកា</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="rounded-2xl bg-pink-50/75 px-3 py-2 text-sm font-bold text-pink-700 transition-colors hover:bg-pink-100">
                    {s.num}. {s.title}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              {sections.map((s, index) => (
                <article
                  key={s.id}
                  id={s.id}
                  className="group scroll-mt-28 overflow-hidden rounded-[1.7rem] border border-pink-100 bg-white/82 shadow-lg shadow-pink-100/45 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-200/45"
                >
                  <div className="h-1.5 bg-gradient-to-r from-pink-400 via-fuchsia-400 to-rose-300" />
                  <div className="p-5 sm:p-6">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-pink-300/45">
                        {s.num}
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-400">Section {index + 1}</p>
                        <h2 className="mt-1 font-display text-xl font-black text-pink-950 sm:text-2xl">{s.title}</h2>
                      </div>
                    </div>
                    <div className="privacy-content text-[15px] font-medium leading-8 text-pink-800/78">
                      {s.content}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[2rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50 to-white p-6 text-center shadow-xl shadow-pink-100/60">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-pink-400">Developer</p>
              <a
                href="https://sop-khal.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-300/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                Visit Sokphal Portfolio ↗
              </a>
            </div>

            <div className="mt-8 text-center">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-5 py-2.5 text-sm font-black text-pink-600 shadow-sm shadow-pink-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-pink-50"
              >
                ↑ ត្រឡប់ទៅខាងលើ
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
