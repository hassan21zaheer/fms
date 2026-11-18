<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            if (! Schema::hasColumn('organizations', 'rtl_enabled')) {
                $table->boolean('rtl_enabled')->default(false)->after('language');
            }
            if (! Schema::hasColumn('organizations', 'default_locale')) {
                $table->string('default_locale', 10)->default('en')->after('rtl_enabled');
            }
            if (! Schema::hasColumn('organizations', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        if (! Schema::hasTable('question_branch_overrides')) {
            Schema::create('question_branch_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
                $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
                $table->foreignId('form_id')->constrained()->cascadeOnDelete();
                $table->foreignId('question_id')->constrained()->cascadeOnDelete();
                $table->boolean('is_hidden')->default(false);
                $table->string('text_override')->nullable();
                $table->boolean('is_required_override')->nullable();
                $table->decimal('weight_override', 8, 2)->nullable();
                $table->unsignedInteger('sort_order_override')->nullable();
                $table->boolean('follow_up_on_low_override')->nullable();
                $table->unsignedTinyInteger('low_score_threshold_override')->nullable();
                $table->timestamps();

                $table->unique(['branch_id', 'question_id'], 'qbo_branch_question_unique');
                $table->index(['organization_id', 'form_id', 'branch_id'], 'qbo_org_form_branch_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('question_branch_overrides');

        Schema::table('organizations', function (Blueprint $table) {
            if (Schema::hasColumn('organizations', 'rtl_enabled')) {
                $table->dropColumn('rtl_enabled');
            }
            if (Schema::hasColumn('organizations', 'default_locale')) {
                $table->dropColumn('default_locale');
            }
            if (Schema::hasColumn('organizations', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
