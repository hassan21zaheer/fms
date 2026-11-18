<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            // How many times the guest form behind this location's QR code was opened.
            $table->unsignedInteger('scans_count')->default(0)->after('is_active');
            $table->timestamp('last_scan_at')->nullable()->after('scans_count');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->string('tagline', 160)->nullable()->after('name');
            $table->string('support_email', 120)->nullable()->after('tagline');
            $table->string('support_phone', 40)->nullable()->after('support_email');
            $table->string('address', 255)->nullable()->after('support_phone');
        });

        Schema::table('form_categories', function (Blueprint $table) {
            $table->string('icon', 40)->nullable()->after('weight');
            $table->string('color', 20)->nullable()->after('icon');
        });
    }

    public function down(): void
    {
        Schema::table('form_categories', function (Blueprint $table) {
            $table->dropColumn(['icon', 'color']);
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['tagline', 'support_email', 'support_phone', 'address']);
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn(['scans_count', 'last_scan_at']);
        });
    }
};
