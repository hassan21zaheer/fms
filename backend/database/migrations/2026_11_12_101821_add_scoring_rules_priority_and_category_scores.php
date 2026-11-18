<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scoring_settings', function (Blueprint $table) {
            $table->boolean('flag_on_overall')->default(true)->after('flag_threshold');
            $table->decimal('critical_threshold', 5, 2)->default(50)->after('flag_on_critical_question');
            $table->boolean('flag_on_category')->default(true)->after('critical_threshold');
        });

        // Organizations that already exist keep behaving exactly as they did: the critical-question rule
        // used the overall threshold, and the category rule was off when its limit was empty.
        DB::table('scoring_settings')->get()->each(function ($row) {
            DB::table('scoring_settings')->where('id', $row->id)->update([
                'critical_threshold' => $row->flag_threshold,
                'flag_on_category' => $row->flag_category_threshold !== null,
                'flag_category_threshold' => $row->flag_category_threshold ?? 50,
            ]);
        });

        Schema::table('feedback_cases', function (Blueprint $table) {
            $table->string('priority', 20)->default('medium')->after('status');
        });

        DB::table('feedback_cases')
            ->join('submissions', 'submissions.id', '=', 'feedback_cases.submission_id')
            ->select('feedback_cases.id', 'submissions.overall_score')
            ->get()
            ->each(function ($row) {
                $priority = match (true) {
                    $row->overall_score !== null && (float) $row->overall_score < 35 => 'urgent',
                    $row->overall_score !== null && (float) $row->overall_score < 50 => 'high',
                    default => 'medium',
                };

                DB::table('feedback_cases')->where('id', $row->id)->update(['priority' => $priority]);
            });

        Schema::table('submissions', function (Blueprint $table) {
            $table->json('category_scores')->nullable()->after('rating_band');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn('category_scores');
        });

        Schema::table('feedback_cases', function (Blueprint $table) {
            $table->dropColumn('priority');
        });

        Schema::table('scoring_settings', function (Blueprint $table) {
            $table->dropColumn(['flag_on_overall', 'critical_threshold', 'flag_on_category']);
        });
    }
};
