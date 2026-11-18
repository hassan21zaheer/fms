<?php

namespace App\Support;

class PhoneNumber
{
    /**
     * Turn a phone number as people type it into the digits-only international form WhatsApp links need.
     *
     * Numbers written with "+" or "00" already carry their country code. Local numbers starting with 0
     * (03xx...) get the organization's default country code in place of that 0.
     */
    public static function forWhatsApp(?string $phone, ?string $defaultCountryCode): string
    {
        $raw = trim((string) $phone);
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        $code = preg_replace('/\D+/', '', (string) $defaultCountryCode) ?? '';

        if ($digits === '') {
            return '';
        }

        if (str_starts_with($raw, '+')) {
            return $digits;
        }

        if (str_starts_with($digits, '00')) {
            return substr($digits, 2);
        }

        if ($code === '') {
            return $digits;
        }

        if (str_starts_with($digits, '0')) {
            return $code.ltrim($digits, '0');
        }

        if (str_starts_with($digits, $code) && strlen($digits) > strlen($code) + 7) {
            return $digits;
        }

        return $code.$digits;
    }
}
