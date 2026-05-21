import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from './Icon';

type TopbarProps = {
   showSettings: Function,
   showAddModal: Function,
}

const TopBar = ({ showSettings, showAddModal }: TopbarProps) => {
   const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
   const router = useRouter();

   const logoutUser = () => {
      window.location.href = '/api/auth/logout';
   };

   return (
      <div className="topbar flex w-full justify-between bg-white lg:hidden border-b border-gray-100">
         <h3 className="p-4 text-base font-bold text-blue-700">
            <span className="relative top-[3px] mr-1">
               <Icon type="logo" size={24} color="#364AFF" />
            </span>
            SerpBear
            <button
               className="px-3 py-1 font-bold text-blue-700 ml-3 text-lg"
               onClick={() => showAddModal()}
            >
               +
            </button>
         </h3>
         <div className="topbar__right">
            <button className="p-3" onClick={() => setShowMobileMenu(!showMobileMenu)}>
               <Icon type="hamburger" size={24} />
            </button>
            <ul
               className={`text-sm font-semibold text-gray-500 absolute right-3 bg-white
               border border-gray-200 z-50 ${showMobileMenu ? 'block' : 'hidden'}`}
               style={{ top: '52px' }}
            >
               <li className={`block ${router.asPath === '/domains' ? 'text-blue-700' : ''}`}>
                  <Link href="/domains" passHref>
                     <a className="block px-3 py-2 cursor-pointer">
                        <Icon type="domains" color={router.asPath === '/domains' ? '#1d4ed8' : '#888'} size={14} /> Domains
                     </a>
                  </Link>
               </li>
               <li className={`block ${router.asPath === '/research' ? 'text-blue-700' : ''}`}>
                  <Link href="/research" passHref>
                     <a className="block px-3 py-2 cursor-pointer">
                        <Icon type="research" color={router.asPath === '/research' ? '#1d4ed8' : '#888'} size={14} /> Research
                     </a>
                  </Link>
               </li>
               <li className="block">
                  <Link href="/settings" passHref>
                     <a className="block px-3 py-2 cursor-pointer">
                        <Icon type="settings-alt" color="#888" size={14} /> Settings
                     </a>
                  </Link>
               </li>
               <li className="block">
                  <a className="block px-3 py-2 cursor-pointer" href="https://docs.serpbear.com/" target="_blank" rel="noreferrer">
                     <Icon type="question" color="#888" size={14} /> Help
                  </a>
               </li>
               <li className="block">
                  <a className="block px-3 py-2 cursor-pointer" onClick={() => logoutUser()}>
                     <Icon type="logout" color="#888" size={14} /> Logout
                  </a>
               </li>
            </ul>
         </div>
      </div>
   );
};

export default TopBar;
