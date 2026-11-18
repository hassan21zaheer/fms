<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->timestamp('scanned_at')->useCurrent();

            $table->index(['organization_id', 'scanned_at']);
            $table->index(['location_id', 'scanned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_scans');
    }
};
