<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scoring_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('flag_threshold', 8, 2)->default(40);
            $table->json('rating_bands')->nullable();
            $table->boolean('flag_on_critical_question')->default(true);
            $table->decimal('flag_category_threshold', 8, 2)->nullable();
            $table->json('customer_fields')->nullable(); // name/phone/email => required|optional|hidden
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'phone']);
            $table->index(['organization_id', 'email']);
        });

        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->decimal('overall_score', 8, 2)->nullable();
            $table->string('rating_band', 40)->nullable();
            $table->boolean('is_flagged')->default(false);
            $table->json('flag_reasons')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamps();

            $table->index(['organization_id', 'submitted_at']);
            $table->index(['branch_id', 'is_flagged']);
            $table->index(['location_id', 'submitted_at']);
        });

        Schema::create('submission_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->nullable()->constrained()->nullOnDelete();
            $table->string('question_text_snapshot');
            $table->string('question_type_snapshot', 40);
            $table->string('option_label_snapshot')->nullable();
            $table->decimal('score_snapshot', 8, 2)->nullable();
            $table->decimal('weight_snapshot', 8, 2)->default(1);
            $table->text('free_text_value')->nullable();
            $table->boolean('is_critical_snapshot')->default(false);
            $table->foreignId('form_category_id')->nullable();
            $table->string('category_name_snapshot')->nullable();
            $table->timestamps();
        });

        Schema::create('feedback_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submission_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('open'); // open, in_progress, resolved
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['branch_id', 'status']);
        });

        Schema::create('case_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_case_id')->constrained('feedback_cases')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('note');
            $table->timestamps();
        });

        Schema::create('notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('email_on_flagged')->default(true);
            $table->json('notify_emails')->nullable();
            $table->boolean('whatsapp_enabled')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_settings');
        Schema::dropIfExists('case_notes');
        Schema::dropIfExists('feedback_cases');
        Schema::dropIfExists('submission_answers');
        Schema::dropIfExists('submissions');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('scoring_settings');
    }
};
