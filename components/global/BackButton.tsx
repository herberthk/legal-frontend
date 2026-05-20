"use client"
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

const BackButton = () => {
    const router = useRouter()
    return (
        <button onClick={() => router.back()}
            className="p-1 bg-transparent  rounded-2xl  hover:scale-105 transition-all shadow-sm md:hidden"
        >
            <ChevronLeft size={28} className='text-slate-500 dark:text-slate-400 font-extrabold' />
        </button>
    )
}

export default BackButton 