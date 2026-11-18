<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->decimal('price_monthly', 10, 2)->default(0);
            $table->unsignedInteger('branch_limit')->default(1);
            $table->unsignedInteger('location_limit')->nullable();
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->foreignId('plan_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->timestamp('plan_expires_at')->nullable()->after('branch_limit');
            $table->string('domain_verification_token', 64)->nullable()->after('domain');
            $table->timestamp('domain_verified_at')->nullable()->after('domain_verification_token');
        });

        Schema::create('customer_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('submission_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 20); // email, whatsapp
            $table->string('to_address');
            $table->string('subject')->nullable();
            $table->text('body');
            $table->string('status', 30)->default('sent'); // queued, sent, failed, link_ready
            $table->string('external_link')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_messages');

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('plan_id');
            $table->dropColumn([
                'plan_expires_at',
                'domain_verification_token',
                'domain_verified_at',
            ]);
        });

        Schema::dropIfExists('plans');
    }
};
