<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('logo_path')->nullable();
            $table->string('primary_color', 20)->default('#0F766E');
            $table->string('secondary_color', 20)->default('#134E4A');
            $table->unsignedInteger('branch_limit')->default(3);
            $table->string('status', 20)->default('active'); // active, suspended
            $table->string('domain')->nullable()->unique();
            $table->string('welcome_text')->nullable();
            $table->string('thank_you_text')->nullable();
            $table->string('language', 10)->default('en');
            $table->text('privacy_note')->nullable();
            $table->boolean('allow_anonymous')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
