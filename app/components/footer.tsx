import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-stone-50 dark:bg-zinc-950 border-t border-stone-200 dark:border-zinc-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-stone-900 dark:bg-white rounded flex items-center justify-center text-white dark:text-stone-900 text-xs font-bold">
                C
              </div>
              <span className="font-bold text-stone-900 dark:text-white">Curator</span>
            </div>
            <p className="text-sm text-stone-500 dark:text-zinc-400">AI-powered estate sales management</p>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-white">Product</h4>
            <Link href="/features" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Pricing
            </Link>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-white">Company</h4>
            <Link href="/about" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              About
            </Link>
          </div>

          {/* Support */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-white">Support</h4>
            <Link href="/help" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Help Center
            </Link>
            <Link href="/help/docs" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Documentation
            </Link>
            <Link href="/help/tutorials" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Tutorials
            </Link>
            <Link href="/help?tab=contact" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Contact Us
            </Link>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-white">Legal</h4>
            <Link href="/privacy" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-stone-200 dark:border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-stone-500 dark:text-zinc-400">&copy; {new Date().getFullYear()} Curator Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
