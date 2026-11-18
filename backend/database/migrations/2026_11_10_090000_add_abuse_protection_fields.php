<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->unsignedInteger('duplicate_window_minutes')->default(60)->after('allow_anonymous');
            $table->string('public_base_url')->nullable()->after('domain');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['duplicate_window_minutes', 'public_base_url']);
        });
    }
};
