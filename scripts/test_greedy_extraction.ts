
import { filterImagesByUnused } from '../src/utils/extract-ai-images.js';
import { GeneratedImage } from '../src/types.js';

// Mock function helper
function mockImage(id: string): GeneratedImage {
    return {
        id,
        url: `https://example.com/${id}.png`,
        prompt: `Prompt for ${id}`,
        ratio: "16:9",
        width: "100%",
        createdAt: Date.now()
    };
}

async function runTest() {
    console.log('🧪 Testing Greedy Image Extraction...');

    const img1 = mockImage('img-1'); // Used in attribute
    const img2 = mockImage('img-2'); // Used in JS string
    const img3 = mockImage('img-3'); // Used in JSON
    const img4 = mockImage('img-4'); // Not used
    const img5 = mockImage('img-5'); // Used in data attribute (standard)

    const allImages = [img1, img2, img3, img4, img5];

    const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <!-- Standard usage -->
        <img src="..." data-image-id="${img5.id}" />

        <!-- JS usage -->
        <script>
          const background = "${img2.id}";
          const config = ${JSON.stringify({ headerImage: img3.id })};
        </script>

        <!-- Weird usage (attribute value) -->
        <div data-bg="${img1.id}"></div>
      </body>
    </html>
  `;

    console.log('🔍 Filtering images against HTML...');
    const usedImages = filterImagesByUnused(html, allImages);

    const usedIds = new Set(usedImages.map(i => i.id));

    // Assertions
    const checks = [
        { id: img1.id, shouldBeFound: true, reason: 'Attribute value' },
        { id: img2.id, shouldBeFound: true, reason: 'JS variable' },
        { id: img3.id, shouldBeFound: true, reason: 'JSON content' },
        { id: img5.id, shouldBeFound: true, reason: 'Standard data-image-id' },
        { id: img4.id, shouldBeFound: false, reason: 'Unused image' },
    ];

    let passed = true;
    for (const check of checks) {
        const found = usedIds.has(check.id);
        if (found === check.shouldBeFound) {
            console.log(`✅ ${check.id} (${check.reason}): ${found ? 'Found' : 'Not found'} as expected`);
        } else {
            console.error(`❌ ${check.id} (${check.reason}): Expected ${check.shouldBeFound} but got ${found}`);
            passed = false;
        }
    }

    if (passed) {
        console.log('\n✨ All tests passed!');
        process.exit(0);
    } else {
        console.error('\n💥 Some tests failed.');
        process.exit(1);
    }
}

runTest().catch(console.error);
