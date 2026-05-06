<script>
  import Editor from './lib/Editor.svelte';
</script>

<div class="p-6 md:p-10 flex flex-col items-center min-h-screen">
  <div class="w-full max-w-5xl">
    <h1 class="text-3xl font-bold mb-4 text-center">Threadweaver</h1>
    <p class="text-sm text-gray-400 text-center mb-6">
      Write your post below. Use three blank lines to create a new post chunk.
      Characters over the limit will be highlighted in red.
    </p>
    <Editor />
  </div>
</div>
