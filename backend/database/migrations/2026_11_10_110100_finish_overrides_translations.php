<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('question_branch_overrides')) {
            $indexes = collect(Schema::getIndexes('question_branch_overrides'))->pluck('name');
            Schema::table('question_branch_overrides', function (Blueprint $table) use ($indexes) {
                if (! $indexes->contains('qbo_org_form_branch_idx')) {
                    $table->index(['organization_id', 'form_id', 'branch_id'], 'qbo_org_form_branch_idx');
                }
            });
        }

        if (! Schema::hasColumn('organizations', 'default_locale')) {
            Schema::table('organizations', function (Blueprint $table) {
                $table->string('default_locale', 10)->default('en')->after('language');
            });
        }

        if (! Schema::hasTable('translations')) {
            Schema::create('translations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
                $table->string('translatable_type');
                $table->unsignedBigInteger('translatable_id');
                $table->string('locale', 10);
                $table->string('field', 50);
                $table->text('value');
                $table->timestamps();
                $table->unique(['translatable_type', 'translatable_id', 'locale', 'field'], 'translations_unique');
                $table->index(['organization_id', 'locale'], 'translations_org_locale_idx');
            });
        }

        if (! Schema::hasColumn('notification_settings', 'weekly_summary_enabled')) {
            Schema::table('notification_settings', function (Blueprint $table) {
                $table->boolean('weekly_summary_enabled')->default(false)->after('whatsapp_enabled');
                $table->string('weekly_summary_day', 10)->default('monday')->after('weekly_summary_enabled');
            });
        }
    }

    public function down(): void
    {
        //
    }
};
