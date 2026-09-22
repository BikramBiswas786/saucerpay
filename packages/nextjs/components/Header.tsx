"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-hbar";
import { useOutsideClick } from "~~/hooks/scaffold-hbar";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "Invoices", href: "/" },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
              } py-1.5 px-3 text-sm rounded-full gap-2 grid grid-flow-col transition-colors`}
            >
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
      <li>
        <a
          href="https://hashscan.io/testnet/contract/0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3"
          target="_blank"
          rel="noreferrer"
          className="py-1.5 px-3 text-sm rounded-full hover:bg-primary/5"
        >
          Contract
        </a>
      </li>
      <li>
        <a
          href="https://github.com/BikramBiswas786/saucerpay"
          target="_blank"
          rel="noreferrer"
          className="py-1.5 px-3 text-sm rounded-full hover:bg-primary/5"
        >
          GitHub
        </a>
      </li>
    </>
  );
};

export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 shadow-sm border-b border-base-300 px-0 sm:px-2">
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-box w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="flex items-center gap-3 ml-4 mr-6 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content font-bold text-sm">
            SP
          </div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight text-base">SaucerPay</span>
            <span className="text-[10px] tracking-wider uppercase text-base-content/50 font-medium">
              Invoice escrow on Hedera
            </span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-2">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
