<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            // null means "use the organization's customer field settings".
            $table->json('customer_fields')->nullable()->after('is_active');
            $table->json('extra_fields')->nullable()->after('customer_fields');
            // null means "use the organization's welcome / thank-you text".
            $table->string('welcome_title')->nullable()->after('extra_fields');
            $table->text('welcome_text')->nullable()->after('welcome_title');
            $table->string('thank_you_title')->nullable()->after('welcome_text');
            $table->text('thank_you_text')->nullable()->after('thank_you_title');
        });

        Schema::table('form_categories', function (Blueprint $table) {
            // null means "automatic": the sum of the weights of its questions.
            $table->decimal('weight', 8, 2)->nullable()->after('name');
        });

        Schema::table('submissions', function (Blueprint $table) {
            $table->json('customer_extra')->nullable()->after('customer_email');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn('customer_extra');
        });

        Schema::table('form_categories', function (Blueprint $table) {
            $table->dropColumn('weight');
        });

        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn([
                'customer_fields',
                'extra_fields',
                'welcome_title',
                'welcome_text',
                'thank_you_title',
                'thank_you_text',
            ]);
        });
    }
};
