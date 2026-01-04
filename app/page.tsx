"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  ArrowRight, 
  Zap,
  BarChart3,
  Shield,
  Users,
  Mail,
  Loader2,
  X
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Link from "next/link";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    // Set launch date to 30 days from Jan 4, 2026 -> Feb 3, 2026
    const launchDate = new Date("2026-02-03T00:00:00").getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = launchDate - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-4 text-center">
      {[
        { label: "Days", value: timeLeft.days },
        { label: "Hours", value: timeLeft.hours },
        { label: "Minutes", value: timeLeft.minutes },
        { label: "Seconds", value: timeLeft.seconds }
      ].map((item, i) => (
        <div key={i} className="flex flex-col">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-zinc-900 dark:text-white">
            {String(item.value).padStart(2, '0')}
          </span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const Navbar = () => {
  return (
    <nav className="sticky top-0 left-0 right-0 z-40 bg-stone-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-stone-200/50 dark:border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stone-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-stone-900 font-bold">C</div>
            <span className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">Curator</span>
          </div>
          <div className="text-sm font-medium text-stone-500">
            Launching Feb 2026
          </div>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    // Simulate API call
    setTimeout(() => setStatus("success"), 1500);
  };

  return (
    <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6">
              Estate sales management,{" "}
              <br></br>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">10x faster.</span>
            </h1>
            
            <p className="text-lg text-stone-600 dark:text-zinc-400 mb-6 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Curator is the AI-powered platform that helps estate sale professionals price items instantly, manage inventory effortlessly, and close sales faster than ever before.
            </p>

            <div className="flex flex-col gap-2 text-sm text-stone-500 dark:text-zinc-400 mb-8">
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>AI-powered instant valuations</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Automated inventory management</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Professional billing & receipts</span>
              </div>
            </div>

            <div className="flex flex-col items-center lg:items-start gap-2 mb-8">
              <span className="text-sm font-medium text-stone-500 uppercase tracking-wider">Launching in</span>
              <Countdown />
            </div>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto lg:mx-0 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="block w-full pl-10 pr-3 py-3 border border-stone-300 dark:border-zinc-800 rounded-xl leading-5 bg-white dark:bg-zinc-900 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={status !== "idle"}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {status === "loading" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === "success" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <>
                    Notify Me <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
                  </>
                )}
              </button>
            </form>
            {status === "success" && (
              <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {"Thanks! We've added you to the list."}
              </p>
            )}
          </motion.div>

          {/* Right Column - App Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center lg:justify-end"
          >
            {/* Phone Mockup */}
            <div className="relative mx-auto border-zinc-800 bg-zinc-900 border-[14px] rounded-[2.5rem] h-[580px] w-[280px] shadow-2xl">
              <div className="h-[32px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
              <div className="h-[46px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
              <div className="h-[46px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
              <div className="h-[64px] w-[3px] bg-zinc-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
              <div className="rounded-[2rem] overflow-hidden w-full h-full bg-zinc-100 dark:bg-zinc-800 relative">
                {/* Simulated App UI */}
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1618674622469-d7fd1a22fcf8?q=80&w=986&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")' }}></div>
                <div className="absolute inset-0 bg-black/40"></div>
                
                {/* Scanning Overlay */}
                <motion.div 
                  animate={{ y: [0, 450, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute top-4 left-4 right-4 h-0.5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]"
                />
                
                {/* Price Tag - appears after scan completes */}
                <motion.div 
                  animate={{ 
                    opacity: [0, 0, 1, 1, 1, 0],
                    scale: [0.9, 0.9, 1, 1, 1, 0.9],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 9,
                    times: [0, 0.3, 0.35, 0.88, 0.95, 1],
                    ease: "easeOut"
                  }}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl text-zinc-900 dark:text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/20 dark:border-zinc-700/30"
                >
                  {/* Item name */}
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">Vintage Ceramic Vase</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">Mid-century • Decorative</p>
                  
                  {/* Price */}
                  <p className="text-2xl font-bold text-white mb-2">$145.00</p>
                  
                  {/* Confidence badge */}
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">High confidence</span>
                  </div>
                </motion.div>

                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-t-3xl border-t border-zinc-200/50 dark:border-zinc-700/50">
                  <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4"></div>
                  <button className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl font-medium text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Add to Inventory</button>
                </div>
              </div>
            </div>

            {/* Floating Stats Card */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -left-4 top-24 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-xl border border-stone-200 dark:border-zinc-700 hidden sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Items Scanned</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-white">1,247</p>
                </div>
              </div>
            </motion.div>

            {/* Floating Revenue Card */}
            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -right-4 bottom-32 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-xl border border-stone-200 dark:border-zinc-700 hidden sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Total Value</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-white">$42,850</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      title: "AI-Powered Valuations",
      description: "Get accurate market prices in seconds. Our AI analyzes millions of auction records, eBay sales, and dealer prices to give you confidence in every valuation.",
      icon: <Zap className="w-6 h-6" />,
      highlight: "3-second pricing"
    },
    {
      title: "Smart Inventory",
      description: "Automatically categorize and tag items as you scan. Generate shareable catalogs, track what's sold, and never lose track of a single piece.",
      icon: <BarChart3 className="w-6 h-6" />,
      highlight: "Auto-categorization"
    },
    {
      title: "Instant Payments",
      description: "Accept credit cards, send professional invoices, and get paid instantly. Integrated with Stripe for secure, seamless transactions.",
      icon: <Shield className="w-6 h-6" />,
      highlight: "Stripe-powered"
    },
    {
      title: "Team Collaboration",
      description: "Invite team members, assign roles, and work together on large estates. Real-time sync keeps everyone on the same page.",
      icon: <Users className="w-6 h-6" />,
      highlight: "Multi-user access"
    }
  ];

  return (
    <section className="py-24 bg-stone-100/50 dark:bg-zinc-900/30 border-t border-stone-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4">Everything you need to run a professional sale</h2>
          <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">From valuation to payment, Curator handles the entire workflow so you can focus on what matters—selling.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4 text-indigo-600 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                {feature.icon}
              </div>
              <span className="inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-full mb-3">{feature.highlight}</span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PoweredBy = () => {
  return (
    <section className="py-16 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-stone-500 mb-8 uppercase tracking-wider">Powered by industry-leading technology</p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {/* AWS */}
          <div className="flex items-center gap-2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"/>
              <path d="M21.725 15.251c-2.455 1.813-6.019 2.779-9.085 2.779-4.299 0-8.17-1.59-11.098-4.235-.23-.207-.024-.49.251-.328 3.161 1.838 7.072 2.947 11.114 2.947 2.725 0 5.722-.566 8.48-1.74.415-.175.766.272.338.577z"/>
              <path d="M22.693 14.135c-.313-.4-2.07-.191-2.862-.096-.24.032-.279-.184-.063-.335 1.406-.982 3.709-.702 3.975-.375.264.335-.072 2.63-1.39 3.727-.199.167-.391.08-.303-.144.295-.726.95-2.373.643-2.777z"/>
            </svg>
            <span className="font-semibold text-lg">AWS</span>
          </div>
          
          {/* Stripe */}
          <div className="flex items-center gap-2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
            </svg>
            <span className="font-semibold text-lg">Stripe</span>
          </div>
          
          {/* OpenAI */}
          <div className="flex items-center gap-2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            <span className="font-semibold text-lg">OpenAI</span>
          </div>
          
          {/* Google Gemini */}
          <div className="flex items-center gap-2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2 L12,2 C12,7.52 16.48,12 22,12 L22,12 L22,12 C16.48,12 12,16.48 12,22 L12,22 L12,22 C12,16.48 7.52,12 2,12 L2,12 L2,12 C7.52,12 12,7.52 12,2 L12,2 Z" />
            </svg>
            <span className="font-semibold text-lg">Gemini</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const CTASection = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setTimeout(() => setStatus("success"), 1500);
  };

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-stone-900 dark:bg-black"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-stone-900 to-stone-900"></div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-6 border border-indigo-500/20">
              <Zap className="w-4 h-4" />
              Limited Early Access
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Ready to transform your estate sales?</h2>
            <p className="text-xl text-stone-400 max-w-2xl mx-auto leading-relaxed">
              Join 2,000+ professionals on the waitlist. Get exclusive early access, founding member pricing, and priority support.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-xl mx-auto"
        >
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  className="block w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base backdrop-blur-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={status !== "idle"}
                className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                {status === "loading" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === "success" ? (
                  <><CheckCircle2 className="w-5 h-5 mr-2" />{"You're in!"}</>
                ) : (
                  <>Get Early Access<ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </button>
            </div>
          </form>
          
          {status === "success" && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-emerald-400 font-medium"
            >
              Welcome aboard! Check your inbox for next steps.
            </motion.p>
          )}
          
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-stone-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Free to join</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-stone-50 dark:bg-zinc-950 border-t border-stone-200 dark:border-zinc-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-stone-900 dark:bg-white rounded flex items-center justify-center text-white dark:text-stone-900 text-xs font-bold">C</div>
          <span className="font-bold text-stone-900 dark:text-white">Curator</span>
        </div>
        <p className="text-sm text-stone-500">© 2026 Curator Inc. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <PoweredBy />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
